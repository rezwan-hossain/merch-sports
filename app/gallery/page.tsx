// app/gallery/page.tsx
import { redirect } from "next/navigation";
// import GalleryPage from "@/module/gallery/pages/GalleryPage";
// import { getGalleryImages } from "../actions/gallery";

export const metadata = {
  title: "Gallery",
  description: "Photos and memories from our running events.",
};

// Gallery is temporarily off: anyone who opens it goes to the events page.
// To bring it back, delete the redirect and uncomment the lines below (and the
// two imports above).
export default async function Page() {
  redirect("/events");

  // const images = await getGalleryImages();
  // return <GalleryPage images={images} />;
}
