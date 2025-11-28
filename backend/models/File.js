import mongoose from 'mongoose';


const fileSchema = new mongoose.Schema({
workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: false },
document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: false },
uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
originalName: { type: String, required: true },
storageKey: { type: String, required: true, unique: true },
mime: { type: String },
size: { type: Number },
status: { type: String, enum: ['pending','uploaded','processing','failed'], default: 'pending' },
publicUrl: { type: String }, // optional cached public URL (if you want)
thumbnails: [{ url: String, width: Number, height: Number }],
meta: { type: mongoose.Schema.Types.Mixed },
expiresAt: { type: Date }
}, { timestamps: true });


const File = mongoose.model('File', fileSchema);
export default File;