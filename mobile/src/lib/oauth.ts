export type OAuthResult = { cancelled: boolean };
export type SignInWithGoogleOAuth = () => Promise<OAuthResult>;

export const signInWithGoogleOAuth: SignInWithGoogleOAuth = async () => {
  throw new Error("이 플랫폼에서는 Google 로그인을 지원하지 않습니다.");
};
