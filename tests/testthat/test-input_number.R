library(xml2)

test_that("structure is intact", {
  raw <- input_number("id")
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(html)
  expect_true(xml_length(children) == 1)
  children <- xml_child(children)
  expect_true(xml_length(children) == 2)
  children <- xml_child(children, 2)
  expect_true(xml_length(children) == 0)
})

test_that("build environment is added to", {
  content <- input_number("id")
  parts <- make_build_environment()
  eval(
    expression(
      input_number("id")
    ),
    parts
  )
  expect_identical(parts$content, content)
})
