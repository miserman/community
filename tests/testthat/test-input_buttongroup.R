library(xml2)

test_that("structure is intact", {
  raw <- input_buttongroup("label", c("a", "b", "c"))
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(xml_child(html))
  expect_true(xml_length(children) == 2)
  children <- xml_child(children, 2)
  expect_true(xml_length(children) == 6)
  for (child in 1:6) expect_true(xml_length(xml_child(children, child)) == 0)
})

test_that("build environment is added to", {
  content <- input_buttongroup("label", c("a", "b", "c"))
  parts <- make_build_environment()
  eval(
    expression(
      input_buttongroup("label", c("a", "b", "c"))
    ),
    parts
  )
  expect_identical(parts$content, content)
})
