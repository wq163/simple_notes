const fs = require('fs');
const path = require('path');
const db = require('better-sqlite3')('data/app.db');

console.log("=== DB TAGS ===");
const tags = db.prepare('SELECT * FROM tags').all();
console.log(tags);

console.log("\n=== DB NOTE_TAGS ===");
const noteTags = db.prepare('SELECT * FROM note_tags').all();
console.log(noteTags);

console.log("\n=== DB NOTES ===");
const notes = db.prepare('SELECT * FROM notes').all();

for (const note of notes) {
  console.log(`\nNote ID: ${note.id}`);
  console.log(`File Path: ${note.file_path}`);
  try {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(note.user_id);
    const text = fs.readFileSync(`data/users/${user.username}/notes/${note.file_path}`, 'utf-8');
    console.log(`Content:\n>>>${text}<<<`);
  } catch (e) {
    console.error("Error reading file:", e.message);
  }
}
