# prepare and connect data in build.R:
# source("build.R")

# use `page_` functions to add parts of a page:
page_navbar("Motor Trend Car Road Tests")
page_text("Motor Trend Car Road Tests", tag = "h1", class = "text-center")

# use `input_` functions to add input elements that affect outputs:
page_menu(
  input_select(
    "Select a Variable",
    options = "variables",
    label = "variable",
    default = "wt"
  ),
  position = "top",
  default_open = TRUE
)

# use `output_` functions to data display components:
page_section(
  wraps = "col-sm",
  output_plot("variable", "mpg", id = "main_plot"),
  output_table("variable", options = list(dom = "<'row't>"))
)

# add a tooltip
output_info(
  body = c("variables.short_name" = "value"),
  row_style = "stack",
  subto = "main_plot",
  floating = TRUE
)
