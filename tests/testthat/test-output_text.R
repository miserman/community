library(xml2)

test_that("structure is intact", {
  raw <- output_text("text")
  expect_true(is.character(raw) && !any(raw == ""))
  html <- read_html(paste(raw, collapse = ""))
  expect_true(xml_length(html) == 1)
})

test_that("build environment is added to", {
  content <- output_text("displaying", id = "text0")
  parts <- make_build_environment()
  eval(
    expression(
      output_text("displaying")
    ),
    parts
  )
  expect_identical(parts$content, content)
  expect_true(parts$uid == 1)
  expect_true(parts$text$text0$text[[1]] == "displaying")
})

test_that("buttons and expressions are parsed", {
  parts <- make_build_environment()
  eval(
    expression(
      output_text(c(
        "(display text)[r input_id]",
        "?{input_id == value}conditional text"
      ))
    ),
    parts
  )
  expect_identical(
    parts$text$text0$text,
    list(
      list(
        button = list(
          b1 = list(
            text = list("display text"),
            type = "reset",
            target = "input_id"
          )
        ),
        text = "b1"
      ),
      list(
        condition = list(list(id = "input_id", type = "=", value = "value")),
        text = "conditional text"
      )
    )
  )
})
