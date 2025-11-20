/* sample LVGL C snippet */
void screen_main_build(lv_obj_t *root) {
  lv_obj_t *btn1 = lv_btn_create(root);
  lv_obj_t *lbl1 = lv_label_create(root);
  lv_label_set_text(lbl1, "OK BUTTON");
}
