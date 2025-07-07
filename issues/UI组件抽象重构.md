# UI组件抽象重构计划

**任务目标:** 将 `app/pdfano/page.tsx` 重构为基于 React Context 和模块化组件的清晰架构，解决状态管理混乱、逻辑耦合严重的问题。

---

### **执行步骤**

1.  **准备工作 - 类型和目录**
    *   **创建文件:** `types/pdf-annotation.ts`，用于存放共享的 TypeScript 类型定义。
    *   **创建目录:** `components/pdf-ano`，用于存放本次重构创建的新组件。

2.  **创建核心状态容器 - `PdfAnoContext`**
    *   **创建文件:** `contexts/PdfAnoContext.tsx`。
    *   **核心逻辑:**
        *   创建一个 React Context (`PdfAnoContext`) 来统一管理应用状态。
        *   实现一个 `PdfAnoProvider` 组件，封装所有业务逻辑、状态 (`useState`) 和副作用 (`useEffect`)。
        *   提供一个自定义钩子 `usePdfAnoContext`，供子组件消费状态和操作。

3.  **拆分UI - 创建原子组件**
    *   **创建文件:** `components/pdf-ano/PdfToolbar.tsx`
        *   **职责:** 顶部的工具栏，负责显示文档信息、缩放、AI批注等全局操作。
    *   **创建文件:** `components/pdf-ano/PdfViewer.tsx`
        *   **职责:** 中间的PDF查看器，负责渲染PDF页面、高亮标注和搜索结果。
    *   **创建文件:** `components/pdf-ano/SidePanel.tsx`
        *   **职责:** 右侧可拖拽的侧边栏，包含搜索、批注列表和调试信息等标签页。

4.  **重新组装和清理**
    *   **修改文件:** `app/pdfano/page.tsx`
    *   **核心逻辑:**
        *   移除所有旧的业务逻辑和状态管理代码。
        *   使用 `PdfAnoProvider` 包裹整个页面。
        *   像搭积木一样，将 `PdfToolbar`, `PdfViewer`, `SidePanel` 等组件组装成最终的页面。

---

此计划已于 `2025-07-07` 执行完成。

---

### **后续修复记录**

*   **日期:** `2025-07-07`
*   **问题描述:**
    1.  重构后主内容区布局异常，右侧被侧边栏遮挡。
    2.  批注项的回复功能丢失。
    3.  页面刷新后，已加载的PDF内容变为空白。
*   **修复措施:**
    1.  将 `panelWidth` 状态提升至 `PdfAnoContext`，由父组件动态设置主内容区的 `marginRight`。
    2.  在 `SidePanel.tsx` 的 `AnnotationsTab` 组件中，重新添加了回复列表和回复表单的JSX及处理逻辑。
    3.  调整了 `PdfAnoContext` 和 `PdfViewer` 中的 `useEffect` 逻辑，将渲染器配置和懒加载启动移至 `PdfViewer` 挂载后执行，并主动渲染第一页，确保刷新后内容正常显示。
*   **状态:** 所有已知问题均已修复。 