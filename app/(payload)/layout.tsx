import type { ReactNode } from "react";

import configPromise from "@payload-config";
import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import type { ServerFunctionClientArgs } from "payload";

import { importMap } from "./admin/importMap";

type PayloadLayoutProps = {
  children: ReactNode;
};

const payloadServerFunction = async (args: ServerFunctionClientArgs) =>
  handleServerFunctions({
    ...args,
    config: configPromise,
    importMap,
  });

export default function PayloadLayout({ children }: PayloadLayoutProps) {
  return (
    <RootLayout
      config={configPromise}
      importMap={importMap}
      serverFunction={payloadServerFunction}
    >
      {children}
    </RootLayout>
  );
}
