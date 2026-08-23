import { createApp, type Component } from "vue";
import "./styles/base.css";
import { resolvePage, type PageName } from "./composables/resolve-page";
import AlertsPage from "./pages/AlertsPage.vue";
import BackgroundPage from "./pages/BackgroundPage.vue";
import ChatPage from "./pages/ChatPage.vue";
import FooterPage from "./pages/FooterPage.vue";
import IndexPage from "./pages/IndexPage.vue";
import NavbarPage from "./pages/NavbarPage.vue";
import PlacementPage from "./pages/PlacementPage.vue";
import PreviewPage from "./pages/PreviewPage.vue";
import QuizPage from "./pages/QuizPage.vue";

const pages: Record<PageName, Component> = {
  background: BackgroundPage,
  navbar: NavbarPage,
  footer: FooterPage,
  chat: ChatPage,
  alerts: AlertsPage,
  quiz: QuizPage,
  placement: PlacementPage,
  preview: PreviewPage,
  index: IndexPage
};

const page = resolvePage(window.location.pathname);
createApp(pages[page]).mount("#app");
