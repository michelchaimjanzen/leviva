import mongoose, { Schema, Document } from 'mongoose';

// Define the TypeScript interface
export interface IPatientResult extends Document {
  patientId: string;
  sequenceId?: string;
  sequenceName?: string;
  testTypesIncluded: string[]; // For filtering by test type (Category 2)
  masterResults: any[];        // The flexible JSON array of all the test data
  sessionDate: Date;
}

// Define the Mongoose Schema
const PatientResultSchema: Schema = new Schema({
  // index: true makes MongoDB organize these fields for lightning-fast searching later
  patientId: { type: String, required: true, index: true }, 
  sequenceId: { type: String },
  sequenceName: { type: String },
  testTypesIncluded: [{ type: String, index: true }], 
  
  // Accept the raw, flexible JSON output from the sequence runner
  masterResults: [{ type: Schema.Types.Mixed }], 
  
  sessionDate: { type: Date, default: Date.now }
});

export default mongoose.model<IPatientResult>('PatientResult', PatientResultSchema);