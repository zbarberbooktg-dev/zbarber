import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { Readable } from "stream";
import {
  db,
  financingRequestsTable,
  barbersTable,
  usersTable,
  galleryPhotosTable,
  homeGalleryPhotosTable,
  articlesTable,
  serviceRealisationsTable,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth, provisionUserFromClerk, type AuthedRequest } from "../lib/clerkAuth";

async function attachOptionalUser(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;
    if (clerkUserId) {
      const user = await provisionUserFromClerk(clerkUserId);
      if (user.status !== "suspended") {
        req.clerkUserId = clerkUserId;
        req.localUser = user;
      }
    }
  } catch (err) {
    req.log?.warn({ err }, "optional auth attach failed");
  }
  next();
}

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serves object entities. Auth model:
 *  - Public-display assets (avatars, salon logos, gallery photos, home gallery) → served openly.
 *  - Financing documents → require admin or owning barber.
 *
 * We optionally attach Clerk auth (no 401 if missing) and check ACL based on path classification.
 */
router.get(
  "/storage/objects/*path",
  attachOptionalUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;

      // Classify the object: is it a financing document?
      const finRows = await db
        .select({ barberId: financingRequestsTable.barberId, docs: financingRequestsTable.documents })
        .from(financingRequestsTable);
      const financingOwners = finRows
        .filter((m) => m.docs.includes(objectPath))
        .map((m) => m.barberId);

      if (financingOwners.length > 0) {
        const user = req.localUser;
        if (!user) {
          res.status(401).json({ error: "Auth required" });
          return;
        }
        if (user.role !== "admin") {
          const [b] = await db
            .select({ id: barbersTable.id })
            .from(barbersTable)
            .where(eq(barbersTable.userId, user.id))
            .limit(1);
          if (!b || !financingOwners.includes(b.id)) {
            res.status(403).json({ error: "Forbidden" });
            return;
          }
        }
      } else {
        // Non-financing object: ensure it's a known public-display asset (avatar, logo, gallery).
        // Otherwise refuse (avoids serving orphan/unreferenced uploads).
        const [byAvatar] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.avatarUrl, objectPath))
          .limit(1);
        const [byLogo] = await db
          .select({ id: barbersTable.id })
          .from(barbersTable)
          .where(eq(barbersTable.logoUrl, objectPath))
          .limit(1);
        const [byGallery] = await db
          .select({ id: galleryPhotosTable.id })
          .from(galleryPhotosTable)
          .where(eq(galleryPhotosTable.photoUrl, objectPath))
          .limit(1);
        const [byHome] = await db
          .select({ id: homeGalleryPhotosTable.id })
          .from(homeGalleryPhotosTable)
          .where(eq(homeGalleryPhotosTable.imageUrl, objectPath))
          .limit(1);
        const [byArticle] = await db
          .select({ id: articlesTable.id })
          .from(articlesTable)
          .where(eq(articlesTable.coverImageUrl, objectPath))
          .limit(1);
        const [byRealisation] = await db
          .select({ id: serviceRealisationsTable.id })
          .from(serviceRealisationsTable)
          .where(or(
            eq(serviceRealisationsTable.beforeUrl, objectPath),
            eq(serviceRealisationsTable.afterUrl, objectPath),
          ))
          .limit(1);
        if (!byAvatar && !byLogo && !byGallery && !byHome && !byArticle && !byRealisation) {
          // Refuse unreferenced objects to prevent reading orphan/private uploads.
          // Clients already hold the local URI immediately after PUT, so they
          // don't need to fetch a freshly-uploaded asset before it's persisted.
          res.status(404).json({ error: "Object not found" });
          return;
        }
      }

      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const response = await objectStorageService.downloadObject(objectFile);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.warn({ err: error }, "Object not found");
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
