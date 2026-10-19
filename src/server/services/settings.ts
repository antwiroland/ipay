import type { ClientSession } from "mongoose";
import { Counter, Setting, type ISetting } from "@/models";
import { connectDB } from "../db";

export async function getSettings(): Promise<ISetting> {
  await connectDB();
  const existing = await Setting.findById("global").lean();
  if (existing) return existing;
  const created = await Setting.findOneAndUpdate(
    { _id: "global" },
    { $setOnInsert: { _id: "global" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  return created!;
}

/** Atomic sequence; runs inside the caller's transaction when a session is given. */
export async function nextSequence(name: string, session?: ClientSession): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  ).lean();
  return doc!.seq;
}

export async function nextOrderNumber(session?: ClientSession): Promise<string> {
  const year = new Date().getUTCFullYear();
  const seq = await nextSequence(`order:${year}`, session);
  return `IPG-${year}-${String(seq).padStart(5, "0")}`;
}
