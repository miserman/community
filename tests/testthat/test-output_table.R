library(xml2)

test_that("default structure is intact", {
  raw <- output_table()
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(raw)
  expect_true(xml_length(xml_child(html)) == 1)
  expect_true(xml_length(xml_child(xml_child(html))) == 0)
})

test_that("simple structure is intact", {
  raw <- output_table(datatables = FALSE)
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(raw)
  expect_true(xml_length(xml_child(html)) == 1)
  expect_true(xml_length(xml_child(xml_child(html))) == 1)
})

test_that("build environment is added to", {
  content <- output_table(id = "table0")
  parts <- make_build_environment()
  eval(
    expression(
      output_table()
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_true(parts$uid == 1)
  expect_identical(names(parts$credits$datatables), c("name", "url", "version"))
  expect_false(is.null(parts$datatable$table0))
  expect_identical(
    names(parts$dependencies),
    c("jquery", "datatables_style", "datatables")
  )
})
