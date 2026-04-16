import { Hono } from "hono";
import { authMiddleware, getUser } from "../middleware/auth";
import type { Env, SessionData } from "../types";

type Variables = { user: SessionData };

const uploadRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

uploadRouter.use("/*", authMiddleware);

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

uploadRouter.post("/", async (c) => {
  const user = getUser(c);
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return c.json({ success: false, error: "No file provided" }, 400);
  }
  const fileObj = file as File;

  if (!ALLOWED_TYPES.includes(fileObj.type)) {
    return c.json(
      { success: false, error: `Unsupported file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
      415
    );
  }

  const buffer = await fileObj.arrayBuffer();
  if (buffer.byteLength > MAX_FILE_SIZE) {
    return c.json({ success: false, error: "File exceeds 10 MB limit" }, 413);
  }

  const ext = fileObj.type.split("/")[1] ?? "bin";
  const key = `uploads/${user.userId}/${crypto.randomUUID()}.${ext}`;

  await c.env.MEDIA.put(key, buffer, {
    httpMetadata: { contentType: fileObj.type },
    customMetadata: { uploadedBy: user.userId, originalName: fileObj.name },
  });

  const publicUrl = `https://api.quiz.rushelwedsivani.com/api/media/${key}`;

  return c.json({ success: true, data: { url: publicUrl, key } }, 201);
});

uploadRouter.delete("/:key{.+}", async (c) => {
  const user = getUser(c);
  const key = c.req.param("key");

  if (!key.startsWith(`uploads/${user.userId}/`)) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  await c.env.MEDIA.delete(key);
  return c.json({ success: true, data: { message: "File deleted" } });
});

export default uploadRouter;
