library(xml2)

test_that("structure is intact", {
  raw <- input_combobox("label", c("a", "b", "c"))
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(xml_child(xml_child(html)))
  expect_true(xml_length(children) == 3)
  children <- xml_child(children, 2)
  expect_true(xml_length(children) == 3)
})

test_that("grouped structure is intact", {
  raw <- input_combobox(
    "label",
    list(a = c(1, 2), b = c(3, 4)),
    display = list(a = c("one", "two"), b = c("three", "four"))
  )
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  children <- xml_child(xml_child(xml_child(html)))
  expect_true(xml_length(children) == 3)
  children <- xml_child(children, 2)
  expect_true(xml_length(children) == 2)
  children <- xml_child(children)
  expect_true(xml_length(children) == 2)
})


test_that("build environment is added to", {
  content <- input_combobox("label", c("a", "b", "c"))
  parts <- make_build_environment()
  eval(
    expression(
      input_combobox("label", c("a", "b", "c"))
    ),
    parts
  )
  expect_identical(parts$content, content)
})
