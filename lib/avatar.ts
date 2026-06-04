/**
 * Returns a profile photo URL, falling back to a generated avatar from ui-avatars.com
 */
export function getAvatarUrl(username: string, profilePhoto?: string | null): string {
  if (profilePhoto && profilePhoto.trim() !== '') {
    return profilePhoto;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=8F0D25&color=ffffff&size=200&bold=true&format=png`;
}
