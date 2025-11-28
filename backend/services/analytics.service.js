// services/analytics.service.js
import WorkspaceAnalytics from '../models/WorkspaceAnalytics.js';
import Activity from '../models/Activity.js';
import dayjs from 'dayjs';

// helper to upsert analytics doc
export const ensureAnalyticsDoc = async (workspaceId) => {
  if (!workspaceId) {
    console.log('ensureAnalyticsDoc called with falsy workspaceId', workspaceId);
    return null;
  }
  let doc = await WorkspaceAnalytics.findOne({ workspace: workspaceId });
  if (!doc) {
    console.log('ensureAnalyticsDoc: creating new analytics doc for workspace', workspaceId);
    doc = await WorkspaceAnalytics.create({ workspace: workspaceId });
  } else {
    // debug
    // console.log('ensureAnalyticsDoc: found existing doc', doc._id?.toString?.());
  }
  return doc;
};

const isoDate = (d = new Date()) => dayjs(d).format('YYYY-MM-DD');

/**
 * Safely increment/decrement activeUsersCount without letting it go negative.
 * Uses MongoDB aggregation pipeline update (atomic) when available.
 * Falls back to $inc + clamp if pipeline not supported.
 */
export const incActiveUsers = async (workspaceId, delta = 1) => {
  if (!workspaceId) {
    console.log('incActiveUsers called with falsy workspaceId, ignoring', workspaceId, delta);
    return null;
  }
  await ensureAnalyticsDoc(workspaceId);

  // try aggregation-pipeline update (atomic clamp at >=0)
  try {
    console.log('incActiveUsers: attempting pipeline update', { workspaceId, delta });
    const updated = await WorkspaceAnalytics.findOneAndUpdate(
      { workspace: workspaceId },
      [
        {
          $set: {
            activeUsersCount: {
              $max: [{ $add: ['$activeUsersCount', delta] }, 0]
            }
          }
        },
        { $set: { updatedAt: new Date() } }
      ],
      { new: true }
    );
    console.log('incActiveUsers: pipeline update result', { workspaceId, delta, activeUsersCount: updated?.activeUsersCount });
    return updated;
  } catch (err) {
    console.warn('analytics.incActiveUsers: pipeline update failed, falling back to safe $inc. Err:', err?.message || err);
  }

  // fallback: increment, then ensure not negative
  try {
    console.log('incActiveUsers: fallback $inc', { workspaceId, delta });
    const bumped = await WorkspaceAnalytics.findOneAndUpdate(
      { workspace: workspaceId },
      { $inc: { activeUsersCount: delta }, $set: { updatedAt: new Date() } },
      { new: true }
    );

    console.log('incActiveUsers: fallback $inc result', { workspaceId, activeUsersCount: bumped?.activeUsersCount });

    if (bumped && bumped.activeUsersCount < 0) {
      // clamp to zero
      console.log('incActiveUsers: clamping negative count to zero for', workspaceId);
      const clamped = await WorkspaceAnalytics.findOneAndUpdate(
        { workspace: workspaceId },
        { $set: { activeUsersCount: 0, updatedAt: new Date() } },
        { new: true }
      );
      console.log('incActiveUsers: clamped result', { workspaceId, activeUsersCount: clamped?.activeUsersCount });
      return clamped;
    }

    return bumped;
  } catch (err) {
    console.error('incActiveUsers fallback failed', err);
    throw err;
  }
};

export const incEdits = async (workspaceId, userId, docId, increment = 1) => {
  const date = isoDate();
  await ensureAnalyticsDoc(workspaceId);
  // increment total and daily bucket
  const res = await WorkspaceAnalytics.findOneAndUpdate(
    { workspace: workspaceId, 'dailyEdits.date': date },
    { 
      $inc: { editsCount: increment, 'dailyEdits.$.count': increment }
    },
    { new: true }
  );

  if (!res) {
    // push new date bucket
    await WorkspaceAnalytics.findOneAndUpdate(
      { workspace: workspaceId },
      { 
        $inc: { editsCount: increment },
        $push: { dailyEdits: { date, count: increment } }
      },
      { new: true }
    );
  }

  // record activity
  await Activity.create({
    workspace: workspaceId,
    document: docId || null,
    user: userId || null,
    action: 'edit',
    meta: { increment }
  });
};

export const incComments = async (workspaceId, userId, docId, increment = 1) => {
  await ensureAnalyticsDoc(workspaceId);
  await WorkspaceAnalytics.findOneAndUpdate(
    { workspace: workspaceId },
    { $inc: { commentsCount: increment } },
    { new: true }
  );

  await Activity.create({
    workspace: workspaceId,
    document: docId || null,
    user: userId || null,
    action: 'comment',
    meta: { increment }
  });
};

export const incUploads = async (workspaceId, userId, docId, fileId, increment = 1) => {
  const date = isoDate();
  await ensureAnalyticsDoc(workspaceId);

  const res = await WorkspaceAnalytics.findOneAndUpdate(
    { workspace: workspaceId, 'dailyUploads.date': date },
    {
      $inc: { uploadsCount: increment, 'dailyUploads.$.count': increment }
    },
    { new: true }
  );

  if (!res) {
    await WorkspaceAnalytics.findOneAndUpdate(
      { workspace: workspaceId },
      { $inc: { uploadsCount: increment }, $push: { dailyUploads: { date, count: increment } } },
      { new: true }
    );
  }

  await Activity.create({
    workspace: workspaceId,
    document: docId || null,
    user: userId || null,
    action: 'upload',
    meta: { fileId }
  });
};

export const pushActivity = async ({ workspaceId, docId, userId, action, meta = {} }) => {
  await ensureAnalyticsDoc(workspaceId);
  return Activity.create({
    workspace: workspaceId,
    document: docId || null,
    user: userId || null,
    action,
    meta
  });
};

// fetch summary + recent activities
export const getWorkspaceAnalytics = async (workspaceId, opts = { activitiesLimit: 20 }) => {
  const analytics = await WorkspaceAnalytics.findOne({ workspace: workspaceId }).lean();
  const activities = await Activity.find({ workspace: workspaceId })
    .sort({ createdAt: -1 })
    .limit(opts.activitiesLimit || 20)
    .populate('user', 'name email')
    .populate('document', 'title')
    .lean();

  return { analytics: analytics || null, activities };
};
