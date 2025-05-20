library(xml2)

test_that("structure is intact", {
  raw <- output_plot()
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(raw)
  expect_true(xml_length(xml_child(html)) == 1)
  expect_true(xml_length(xml_child(xml_child(html))) == 1)
})

test_that("build environment is added to", {
  content <- output_plot(id = "plot0")
  parts <- make_build_environment()
  eval(
    expression(
      output_plot()
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_true(parts$uid == 1)
  expect_identical(names(parts$credits$plotly), c("name", "url", "version"))
  expect_identical(names(parts$plotly$plot0), c("layout", "config", "data"))
  expect_identical(names(parts$dependencies), "plotly")
})
