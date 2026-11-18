import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./app";
import { AuthProvider } from "./auth/auth-provider";
import "./styles.css";
import "./site-shell.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#205b47",
          colorText: "#21352d",
          colorTextSecondary: "#52635a",
          colorBorder: "#d7e0d3",
          colorBorderSecondary: "#e2e8de",
          colorBgLayout: "#faf9f3",
          borderRadius: 9,
          controlHeight: 44,
          fontFamily:
            '"Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif',
        },
        components: {
          Input: { activeShadow: "0 0 0 3px #205b4726" },
          Button: { defaultShadow: "none", primaryShadow: "none" },
          Table: { headerBg: "#f0f4ee", headerColor: "#21352d" },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
