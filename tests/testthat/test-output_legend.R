library(xml2)

test_that("structure is intact", {
  raw <- output_legend()
  expect_true(is.character(raw) && !any(raw == ""))
  html <- xml_child(xml_child(read_html(paste(raw, collapse = ""))))
  expect_true(xml_length(html) == 2)
  expect_true(xml_length(xml_child(html)) == 3)
  expect_true(xml_length(xml_child(html, 2)) == 3)
})

test_that("build environment is added to", {
  content <- sub('id="legend"', 'id="legend0"', output_legend(), fixed = TRUE)
  parts <- make_build_environment()
  eval(
    expression(
      output_legend()
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_true(parts$uid == 1)
  expect_identical(
    parts$legend$legend0,
    list(
      palette = "",
      subto = NULL
    )
  )
})
