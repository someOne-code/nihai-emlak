import type { Metadata } from "next";
import { connection } from "next/server";

import { BlogListPage } from "@/components/blog/blog-list-page";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { listPublishedBlogListPosts } from "@/lib/api/blog";

export const metadata: Metadata = {
  title: "Blog & İçerikler | Nihai Emlak",
  description:
    "Gayrimenkul yatırımı, bölge rehberleri, alıcı rehberleri, hukuk ve piyasa analizi içerikleri.",
};

export default async function BlogIndexPage() {
  await connection();

  const posts = await listPublishedBlogListPosts();

  return (
    <>
      <PublicHeader />
      <BlogListPage posts={posts} />
      <PublicFooter />
    </>
  );
}
