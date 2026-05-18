const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", "backend", ".env") });

const User = require("../../../backend/models/User");
const Income = require("../../../backend/models/Income");
const Expense = require("../../../backend/models/Expense");
const Watchlist = require("../../../backend/models/Watchlist");

const emailRegex = /^qa\./i;

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log("MONGO_URI not set. Skip cleanup.");
    return;
  }

  try {
    mongoose.set("bufferCommands", false);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.log("Mongo not reachable. Skip cleanup.");
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    console.log("Mongo not connected. Skip cleanup.");
    return;
  }

  try {
    const users = await User.find({ email: emailRegex }).select("_id");
    const userIds = users.map((u) => u._id);

    if (userIds.length > 0) {
      await Income.deleteMany({ userId: { $in: userIds } });
      await Expense.deleteMany({ userId: { $in: userIds } });
      await Watchlist.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    console.log("Cleanup done.");
  } catch (err) {
    console.log("Cleanup skipped:", err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Cleanup failed:", err.message);
  process.exitCode = 1;
});
