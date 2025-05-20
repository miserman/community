library(xml2)

test_that("structure is intact", {
  raw <- input_checkbox("label", c("a", "b", "c"))
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(xml_child(xml_child(html)))
  expect_true(xml_length(children) == 2)
  children <- xml_child(children, 2)
  expect_true(xml_length(children) == 3)
  for (child in 1:3) expect_true(xml_length(xml_child(children, child)) == 2)
})

test_that("build environment is added to", {
  content <- input_checkbox("label", c("a", "b", "c"))
  parts <- make_build_environment()
  eval(
    expression(
      input_checkbox("label", c("a", "b", "c"))
    ),
    parts
  )
  expect_identical(parts$content, content)
})
