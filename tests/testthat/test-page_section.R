library(xml2)

test_that("structure is intact", {
  raw <- page_section(input_select("menu item", c("a", "b", "c")))
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(html)
  expect_true(xml_length(children) == 1)
  children <- xml_child(xml_child(xml_child(children)))
  expect_true(xml_length(children) == 2)
  children <- xml_child(children)
  expect_true(xml_length(children) == 3)
})

test_that("build environment is added to", {
  content <- page_section(input_select("menu item", c("a", "b", "c")))
  parts <- make_build_environment()
  eval(
    expression(
      page_section(input_select("menu item", c("a", "b", "c")))
    ),
    parts
  )
  expect_identical(parts$content, content)
})
