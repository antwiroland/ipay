import mongoose, { type Model, type Schema } from "mongoose";

/** Reuse compiled models across hot reloads / serverless invocations. */
export function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema);
}

/** Pesewas field: integer, non-negative by default. */
export const money = (opts: { required?: boolean; min?: number; default?: number } = {}) => ({
  type: Number,
  required: opts.required ?? true,
  min: opts.min ?? 0,
  default: opts.default,
  validate: {
    // Optional money fields may be null/undefined; any value present must be whole pesewas.
    validator: (v: unknown) => v == null || Number.isSafeInteger(v),
    message: "{PATH} must be an integer amount of pesewas",
  },
});

/** Block in-place updates and deletes on append-only collections (ledger, audit). */
export function makeAppendOnly(schema: Schema, label: string) {
  const blocked = [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "findOneAndReplace",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ] as const;
  for (const op of blocked) {
    schema.pre(op, function () {
      throw new Error(`${label} is append-only; ${op} is not permitted`);
    });
  }
  schema.pre("save", function () {
    if (!this.isNew) throw new Error(`${label} is append-only; existing entries cannot be modified`);
  });
}
