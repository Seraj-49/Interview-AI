
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";

// Use a temporary directory that exists on Render
const uploadDir = path.join(os.tmpdir(), "interview-ai-uploads");

// Create the directory if it doesn't exist
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {
        const filename = `${Date.now()}-${file.originalname}`;
        cb(null, filename);
    }
});

export const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});
