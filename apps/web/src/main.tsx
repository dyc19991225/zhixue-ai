import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App as AntApp, ConfigProvider, theme } from "antd";
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
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#34d399",
          colorInfo: "#34d399",
          colorSuccess: "#34d399",
          colorWarning: "#fbbf24",
          colorError: "#fb7185",
          colorText: "#f4f4f5",
          colorTextSecondary: "#a1a1aa",
          colorBgBase: "#09090b",
          colorBgLayout: "#09090b",
          colorBgContainer: "#16181b",
          colorBgElevated: "#202428",
          colorBorder: "#27272a",
          colorBorderSecondary: "#1f2328",
          borderRadius: 14,
          controlHeight: 42,
          fontFamily:
            '"Plus Jakarta Sans", "Inter", "PingFang SC", "HarmonyOS Sans SC", "Source Han Sans SC", "Microsoft YaHei UI", sans-serif',
        },
        components: {
          Input: {
            activeBorderColor: "#34d399",
            hoverBorderColor: "#3f3f46",
            activeShadow: "0 0 0 3px rgba(52, 211, 153, 0.16)",
          },
          Button: {
            defaultShadow: "none",
            primaryShadow: "none",
            primaryColor: "#064e3b",
          },
          Card: {
            borderRadiusLG: 18,
            headerBg: "transparent",
          },
          Table: {
            headerBg: "#14171a",
            headerColor: "#e4e4e7",
            borderColor: "#27272a",
          },
          Select: {
            optionSelectedBg: "rgba(52, 211, 153, 0.16)",
          },
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
