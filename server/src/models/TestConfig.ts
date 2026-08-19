import mongoose, { Schema, Document } from 'mongoose';

// Define the TypeScript interface for type safety
export interface ITestConfig extends Document {
  testName: string;
  testType: string;
  slides: any[]; 
  createdAt: Date;
}

// Define the Mongoose Schema
const TestConfigSchema: Schema = new Schema({
  testName: { type: String, required: true },
  testType: { type: String, required: true },
  slides: [{ type: Schema.Types.Mixed }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ITestConfig>('TestConfig', TestConfigSchema);