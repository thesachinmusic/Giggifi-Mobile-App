// Cloudinary frame-grab transform — shared by every screen that shows a
// video thumbnail before it's tapped open (artist Media tab, vendor Media
// tab), so the grid never has to decode N videos at once just for a still.
// Matches the website's identical transform (cloudinaryThumb in
// app/artists/[id]/artist-public-profile.tsx).
export function cloudinaryThumb(url: string): string | null {
  if (!url.includes("cloudinary.com") || !url.includes("/video/upload/")) return null;
  return url
    .replace("/video/upload/", "/video/upload/w_480,h_640,c_fill,f_jpg,so_1/")
    .replace(/\.(mp4|mov|webm)(\?.*)?$/, ".jpg");
}
