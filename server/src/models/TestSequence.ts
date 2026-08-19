import mongoose, { Schema, Document } from 'mongoose';

export interface ITestSequence extends Document {
  sequenceName: string;
  description?: string;
  steps: {
    stepType: 'info' | 'test';
    testId?: mongoose.Types.ObjectId; // Only if it's a test
    infoContent?: string;             // Only if it's an info page
  }[];
  createdAt: Date;
}

// NOTE: this field used to be called `title`, but SequenceBuilder.tsx has always
// posted `sequenceName`, and App.tsx's Sequence Bank view reads `seq.sequenceName`.
// Because Mongoose schemas are strict by default, the old `title` field silently
// dropped every incoming `sequenceName`, then rejected the save because `title`
// (required) was missing. Renaming this field to `sequenceName` makes the schema
// match what the rest of the app was already sending and reading.
const TestSequenceSchema: Schema = new Schema({
  sequenceName: { type: String, required: true },
  description: { type: String },
  steps: [{
    stepType: { type: String, enum: ['info', 'test'], required: true },
    testId: { type: Schema.Types.ObjectId, ref: 'TestConfig' },
    infoContent: { type: String }
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ITestSequence>('TestSequence', TestSequenceSchema);