import { SDKLanguage } from "back-end/types/sdk-connection";
import { IconType } from "react-icons";
import { DiRuby, DiPython, DiReact, DiAndroid } from "react-icons/di";
import { FaHashtag, FaApple, FaJava, FaCode } from "react-icons/fa";
import {
  SiFlutter,
  SiGo,
  SiJavascript,
  SiNodedotjs,
  SiPhp,
} from "react-icons/si";
import { DocSection } from "@/components/DocLink";

export const languageMapping: Record<
  SDKLanguage,
  {
    Icon: IconType;
    color: string;
    label: string;
    docs: DocSection;
    supportsEncryption: boolean;
    supportsVisualExperiments: boolean;
    supportsSSE: boolean;
    supportsRemoteEval: boolean;
  }
> = {
  react: {
    Icon: DiReact,
    color: "#61DBFB",
    label: "React",
    docs: "tsx",
    supportsEncryption: true,
    supportsVisualExperiments: true,
    supportsSSE: true,
    supportsRemoteEval: true,
  },
  ruby: {
    Icon: DiRuby,
    color: "#A91401",
    label: "Ruby",
    docs: "ruby",
    supportsEncryption: true,
    supportsVisualExperiments: false,
    supportsSSE: false,
    supportsRemoteEval: false,
  },
  python: {
    Icon: DiPython,
    color: "#306998",
    label: "Python",
    docs: "python",
    supportsEncryption: true,
    supportsVisualExperiments: false,
    supportsSSE: false,
    supportsRemoteEval: false,
  },
  android: {
    Icon: DiAndroid,
    color: "#78C257",
    label: "Kotlin",
    docs: "kotlin",
    supportsEncryption: true,
    supportsVisualExperiments: false,
    supportsSSE: false,
    supportsRemoteEval: false,
  },
  csharp: {
    Icon: FaHashtag,
    color: "#684D95",
    label: "C Sharp",
    docs: "csharp",
    supportsEncryption: false,
    supportsVisualExperiments: false,
    supportsSSE: false,
    supportsRemoteEval: false,
  },
  flutter: {
    Icon: SiFlutter,
    color: "#02569B",
    label: "Flutter",
    docs: "flutter",
    supportsEncryption: false,
    supportsVisualExperiments: false,
    supportsSSE: false,
    supportsRemoteEval: false,
  },
  go: {
    Icon: SiGo,
    color: "#29BEB0",
    label: "Golang",
    docs: "go",
    supportsEncryption: true,
    supportsVisualExperiments: false,
    supportsSSE: true,
    supportsRemoteEval: false,
  },
  ios: {
    Icon: FaApple,
    color: "#000000",
    label: "Swift",
    docs: "swift",
    supportsEncryption: true,
    supportsVisualExperiments: false,
    supportsSSE: false,
    supportsRemoteEval: false,
  },
  java: {
    Icon: FaJava,
    color: "#f89820",
    label: "Java",
    docs: "java",
    supportsEncryption: true,
    supportsVisualExperiments: false,
    supportsSSE: true,
    supportsRemoteEval: false,
  },
  javascript: {
    Icon: SiJavascript,
    color: "#f7df1e",
    label: "Javascript",
    docs: "javascript",
    supportsEncryption: true,
    supportsVisualExperiments: true,
    supportsSSE: true,
    supportsRemoteEval: true,
  },
  php: {
    Icon: SiPhp,
    color: "#8993be",
    label: "PHP",
    docs: "php",
    supportsEncryption: true,
    supportsVisualExperiments: false,
    supportsSSE: false,
    supportsRemoteEval: false,
  },
  nodejs: {
    Icon: SiNodedotjs,
    color: "#339933",
    label: "Node.js",
    docs: "javascript",
    supportsEncryption: true,
    supportsVisualExperiments: false,
    supportsSSE: true,
    supportsRemoteEval: false,
  },
  other: {
    Icon: FaCode,
    color: "#777",
    label: "Other",
    docs: "sdks",
    supportsEncryption: false,
    supportsVisualExperiments: false,
    supportsSSE: false,
    supportsRemoteEval: false,
  },
};

export default function SDKLanguageLogo({
  language,
  showLabel = false,
  size = 25,
  titlePrefix = "",
}: {
  language: SDKLanguage;
  showLabel?: boolean;
  size?: number;
  titlePrefix?: string;
}) {
  const { Icon, color, label } =
    languageMapping[language] || languageMapping["other"];

  return (
    <span className="d-inline-flex align-items-center">
      <Icon
        style={{ color, height: size, fontSize: size, lineHeight: size }}
        className="m-0"
        title={titlePrefix + label}
      />
      {showLabel && <span className="ml-1">{label}</span>}
    </span>
  );
}
