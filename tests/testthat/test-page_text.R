library(xml2)

test_that("structure is intact", {
  raw <- page_text("text")
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  expect_true(xml_length(xml_child(html)) == 1)
})

test_that("build environment is added to", {
  content <- page_text("text")
  parts <- make_build_environment()
  eval(
    expression(
      page_text("text")
    ),
    parts
  )
  expect_identical(parts$content, content)
})
