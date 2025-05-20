library(xml2)

test_that("structure is intact", {
  raw <- output_info()
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(html)
  expect_true(xml_length(children) == 1)
})

test_that("build environment is added to", {
  content <- sub('id="info"', 'id="info0"', output_info(), fixed = TRUE)
  parts <- make_build_environment()
  eval(
    expression(
      output_info()
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_true(parts$uid == 1)
  expect_identical(parts$info$info0, list(variable_info = TRUE))
})
