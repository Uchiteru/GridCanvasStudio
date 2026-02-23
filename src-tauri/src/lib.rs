use base64::{engine::general_purpose, Engine as _};
use rust_xlsxwriter::{Image, Workbook, Format, FormatAlign};
use serde::Deserialize;

pub mod cmd {
    use super::*;

    #[derive(Deserialize, Debug)]
    pub struct ExcelNode {
        pub row: u32,
        pub col: u16,
        pub width_px: u32,
        pub height_px: u32,
        pub node_type: String,
        pub text: Option<String>,
        pub base64_image: Option<String>,
        pub span_rows: Option<u32>,
        pub span_cols: Option<u16>,
    }

    #[derive(Deserialize, Debug)]
    pub struct ExcelPage {
        pub name: String,
        pub nodes: Vec<ExcelNode>,
    }

    #[derive(Deserialize, Debug)]
    pub struct ExportPayload {
        pub pages: Vec<ExcelPage>,
        pub grid_size: f64,
    }

    #[tauri::command]
    pub fn generate_excel_file(payload: ExportPayload) -> Result<Vec<u8>, String> {
        let mut workbook = Workbook::new();
        let grid_size = payload.grid_size;

        for (i, page) in payload.pages.iter().enumerate() {
            let safe_name = if page.name.chars().count() > 31 {
                page.name.chars().take(31).collect::<String>()
            } else {
                page.name.clone()
            };
            
            let sheet_name = if safe_name.is_empty() { format!("Sheet{}", i + 1) } else { safe_name };
            let worksheet = workbook.add_worksheet().set_name(&sheet_name).map_err(|e| e.to_string())?;
            
            let mut max_row: u32 = 200;
            let mut max_col: u16 = 200;
            for node in &page.nodes {
                if node.row > max_row { max_row = node.row + 5; }
                if node.col > max_col { max_col = node.col + 5; }
            }

            for r in 0..=max_row {
                worksheet.set_row_height_pixels(r, grid_size as u32).map_err(|e| e.to_string())?;
            }
            worksheet.set_column_range_width_pixels(0, max_col, grid_size as u32).map_err(|e| e.to_string())?;

            let format_text = Format::new()
                .set_align(FormatAlign::Left)
                .set_align(FormatAlign::Top);

            let format_table = Format::new()
                .set_text_wrap()
                .set_align(FormatAlign::Left)
                .set_align(FormatAlign::Top)
                .set_border(rust_xlsxwriter::FormatBorder::Thin);

            let format_th = Format::new()
                .set_text_wrap()
                .set_align(rust_xlsxwriter::FormatAlign::Center)
                .set_align(rust_xlsxwriter::FormatAlign::VerticalCenter)
                .set_border(rust_xlsxwriter::FormatBorder::Thin)
                .set_bold();

            let format_title = Format::new()
                .set_bold()
                .set_font_size(11.0)
                .set_align(FormatAlign::Left)
                .set_align(FormatAlign::Top);

            for node in &page.nodes {
                if node.node_type == "text" || node.node_type == "table_cell" || node.node_type == "table_th" || node.node_type == "node_title" {
                    if let Some(txt) = &node.text {
                        let active_fmt = if node.node_type == "table_th" {
                            &format_th
                        } else if node.node_type == "table_cell" {
                            &format_table
                        } else if node.node_type == "node_title" {
                            &format_title
                        } else {
                            &format_text
                        };

                        let r_span = node.span_rows.unwrap_or(1);
                        let c_span = node.span_cols.unwrap_or(1);
                        if r_span > 1 || c_span > 1 {
                            worksheet.merge_range(
                                node.row, 
                                node.col, 
                                node.row + r_span - 1, 
                                node.col + c_span - 1, 
                                txt, 
                                active_fmt
                            ).map_err(|e| e.to_string())?;
                        } else {
                            worksheet.write_string_with_format(node.row, node.col, txt, active_fmt).map_err(|e| e.to_string())?;
                        }
                    }
                } else if node.node_type == "file" || node.node_type == "image" {
                    if let Some(b64) = &node.base64_image {
                        let parts: Vec<&str> = b64.split("base64,").collect();
                        let b64_data = if parts.len() == 2 { parts[1] } else { b64 };
                        
                        if let Ok(img_data) = general_purpose::STANDARD.decode(b64_data) {
                            if let Ok(image) = Image::new_from_buffer(&img_data) {
                                let scale_x = (node.width_px as f64) / (image.width() as f64);
                                let scale_y = (node.height_px as f64) / (image.height() as f64);
                                
                                let scale_x = if scale_x.is_infinite() || scale_x.is_nan() { 1.0 } else { scale_x };
                                let scale_y = if scale_y.is_infinite() || scale_y.is_nan() { 1.0 } else { scale_y };

                                let image = image.set_scale_width(scale_x).set_scale_height(scale_y);
                                worksheet.insert_image(node.row, node.col, &image).map_err(|e| e.to_string())?;
                            }
                        }
                    }
                }
            }
        }

        let buf = workbook.save_to_buffer().map_err(|e| e.to_string())?;
        Ok(buf)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![cmd::generate_excel_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
