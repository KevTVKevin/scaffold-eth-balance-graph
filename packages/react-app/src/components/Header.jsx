import React from "react";
import { PageHeader } from "antd";

// displays a page header

export default function Header() {
  return (
    <a href="/">
      <PageHeader title="🔏 Sign in with Web3" subTitle="See your Balance Graph..." style={{ cursor: "pointer" }} />
    </a>
  );
}
