import mongoose from 'mongoose';

const programmeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
}, { timestamps: true });

const Programme = mongoose.model('Programme', programmeSchema);
export default Programme;
