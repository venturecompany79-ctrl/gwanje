// Platform-neutral fallback used by TypeScript and unsupported targets.
// iOS/Android resolve push.native.ts; web resolves push.web.ts.
export type RegisterDeviceForPush = () => Promise<void>;

export const registerDeviceForPush: RegisterDeviceForPush = async () => {};
