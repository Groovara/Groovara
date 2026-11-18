import type { Metadata } from "next";
import { AopPartnerPage } from "./aop-page";

export const metadata: Metadata = {
  title: "Art of the Playlist",
  description:
    "Explore Art of the Playlist episodes and their Groovara Mixlists.",
};

export default function Page() {
  return <AopPartnerPage />;
}
