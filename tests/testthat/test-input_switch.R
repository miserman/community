library(xml2)

test_that("structure is intact", {
  raw <- input_switch("label")
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(xml_child(xml_child(html)))
  expect_true(xml_length(children) == 2)
})

test_that("build environment is added to", {
  content <- input_switch("label")
  parts <- make_build_environment()
  eval(
    expression(
      input_switch("label")
    ),
    parts
  )
  expect_identical(parts$content, content)
})
