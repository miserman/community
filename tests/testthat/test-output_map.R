library(xml2)

test_that("structure is intact", {
  raw <- output_map()
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(raw)
  expect_true(xml_length(xml_child(html)) == 1)
})

test_that("build environment is added to", {
  content <- output_map(
    attribution = list(name = "provider", url = "example.com"),
    id = "map0"
  )
  parts <- make_build_environment()
  eval(
    expression(
      output_map(attribution = list(name = "provider", url = "example.com"))
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_true(parts$uid == 1)
  expect_identical(
    parts$credits$provider,
    list(name = "provider", url = "example.com")
  )
  expect_identical(names(parts$map$map0), c("options", "tiles"))
  expect_identical(names(parts$dependencies), c("leaflet_style", "leaflet"))
})
