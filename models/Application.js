import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  gender: String,
  homeAddress: String,
  contactNumber: String,
  occupation: String,
  employer: String,
  workAddress: String,
  workTelephone: String,
  workEmail: { type: String, required: true },
  approvedCentre: String,
  ibesprogrammes: String,
  ibesModules: String,
  employmentHistory: String,
  professionalQualifications: String,
  workingTowards1: String,
  teachingQualifications: String,
  workingTowards2: String,
  teachingEvidence: String,
  researchActivity: String,
  professionalMembership: String,
  
  // Dynamic fields
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  currentStep: { type: Number, default: 1 },
  applicationType: { type: String, required: true }, // e.g., 'DBA', 'M.Ed', 'Tutor'
  dateSubmitted: { type: String, default: () => new Date().toLocaleDateString() },
  assignedLeader: { type: String, default: null },
  
  // For file storage (base64 or references)
  signature: String,
  profilePicture: String,
  resumeCV: [String],
  idPassport: [String],
  certificates: [String],
  transcripts: [String],
  
  // Extra fields for workflow
  notes: [String]
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema);
export default Application;
