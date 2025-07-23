import { FrontendAnnotation } from "./annotation";

export interface ExportRequestDto {
  filename: string;
  articleId: string;
  annotations: FrontendAnnotation[];
}
