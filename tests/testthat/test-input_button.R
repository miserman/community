library(xml2)

test_that("structure is intact", {
  raw <- input_button("reset")
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(xml_child(html))
  expect_true(xml_length(children) == 1)
})

test_that("build environment is added to", {
  content <- input_button("button0", c(input = 1))
  parts <- make_build_environment()
  eval(
    expression(
      input_button("button0", c(input = 1))
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_identical(parts$button$button0$effects, c(input = 1))
})
