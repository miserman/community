library(xml2)

test_that("structure is intact", {
  raw <- output_credits()
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  expect_true(xml_length(xml_child(html)) == 1)
})

test_that("build environment is added to", {
  content <- sub(
    'id="credits"',
    'id="credits0"',
    output_credits(),
    fixed = TRUE
  )
  parts <- make_build_environment()
  eval(
    expression(
      output_credits(list(name = "added"), "excluded")
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_true(parts$uid == 1)
  expect_identical(
    parts$credit_output$credits0,
    list(add = list(list(name = "added")), exclude = "excluded")
  )
})
