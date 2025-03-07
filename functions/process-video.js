const { exec } = require("child_process");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const util = require("util");

const execPromise = util.promisify(exec);

exports.handler = async function(event) {
    try {
        const { m3u8Url } = JSON.parse(event.body);
        if (!m3u8Url) {
            return { statusCode: 400, body: JSON.stringify({ error: "M3U8 URL is required" }) };
        }

        const videoDir = "/tmp/videos";
        const outputFile = "/tmp/output.mp4";

        // Ensure video directory exists
        fs.mkdirSync(videoDir, { recursive: true });

        // Download M3U8 content
        const m3u8Response = await fetch(m3u8Url);
        const m3u8Text = await m3u8Response.text();
        const tsFiles = [];

        // Parse .ts file URLs from M3U8
        for (const line of m3u8Text.split("\n")) {
            if (line.endsWith(".ts")) {
                const tsUrl = new URL(line, m3u8Url).href;
                const tsPath = path.join(videoDir, path.basename(tsUrl));

                // Download each TS file
                const tsResponse = await fetch(tsUrl);
                const tsBuffer = await tsResponse.buffer();
                fs.writeFileSync(tsPath, tsBuffer);
                tsFiles.push(tsPath);
            }
        }

        // Create file list for FFmpeg
        const fileListPath = "/tmp/file_list.txt";
        fs.writeFileSync(fileListPath, tsFiles.map(f => `file '${f}'`).join("\n"));

        // Merge TS files into MP4 using FFmpeg
        await execPromise(`ffmpeg -f concat -safe 0 -i ${fileListPath} -c copy ${outputFile}`);

        // Upload MP4 to Google Drive (or another service)
        const mp4DownloadUrl = await uploadToGoogleDrive(outputFile);

        return {
            statusCode: 200,
            body: JSON.stringify({ downloadUrl: mp4DownloadUrl })
        };
    } catch (error) {
        console.error("Error processing video:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
    }
};

// Function to upload MP4 file to Google Drive (or other storage)
async function uploadToGoogleDrive(filePath) {
    // Use Google Drive API or a free file hosting service like file.io
    const response = await fetch("https://file.io", {
        method: "POST",
        body: fs.createReadStream(filePath)
    });

    const data = await response.json();
    return data.link;  // Returns a temporary download link
}
