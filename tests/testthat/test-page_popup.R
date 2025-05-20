library(xml2)

test_that("structure is intact", {
  raw <- page_popup("title", input_select("menu item", c("a", "b", "c")))
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(html)
  expect_true(xml_length(children) == 1)
})

test_that("build environment is added to", {
  content <- gsub(
    '(["#])dialog"',
    '\\1dialog0"',
    page_popup("title", input_select("menu item", c("a", "b", "c")))
  )
  parts <- make_build_environment()
  eval(
    expression(
      page_popup("title", input_select("menu item", c("a", "b", "c")))
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_identical(
    parts$body[-c(1:3, 14:15)],
    input_select("menu item", c("a", "b", "c"))
  )
})
