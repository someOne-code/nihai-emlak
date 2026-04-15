import configPromise from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";

import { importMap } from "../importMap";

type AdminPageProps = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export const generateMetadata = ({ params, searchParams }: AdminPageProps) =>
  generatePageMetadata({
    config: configPromise,
    params,
    searchParams,
  });

export default function AdminPage({ params, searchParams }: AdminPageProps) {
  return RootPage({
    config: configPromise,
    importMap,
    params,
    searchParams,
  });
}
