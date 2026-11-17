import { PlaceholderPage } from "@/components/placeholder-page";
export default function Page() {
  return (
    <PlaceholderPage
      title="关于知学 AI"
      description="面向初高中学习的教育平台，先把基础打好。"
      items={[
        "当前采用七至九年级、高一至高三导航；地区学制差异后续支持。",
        "课程内容、教材版本与内容授权尚待准备。",
        "知学 AI 为暂定名称，尚未完成品牌与商标确认。",
      ]}
    />
  );
}
