import { __PRIVATE__ } from "styled-components";

export function createTestStyleSheet(target: HTMLElement) {
  // jsdom 不支持 container query；逐条插入可避免一条新语法使整张样式表失效。
  return new __PRIVATE__.StyleSheet({ target, useCSSOMInjection: true });
}
